import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:foplayer/notification_registration.dart';
import 'package:foplayer/strategy_api.dart';

UserStrategy strategy(String id, String symbol, {bool active = true}) =>
    UserStrategy(
      id: id,
      symbol: symbol,
      entryPrice: 1000,
      active: active,
    );

void main() {
  test('registers a device token for each active strategy and token refresh',
      () async {
    final tokenRefresh = StreamController<String>.broadcast();
    final registrations = <String>[];
    final errors = <Object>[];
    var permissionRequests = 0;
    var tokenReads = 0;
    final service = NotificationRegistrationService(
      requestPermission: () async {
        permissionRequests++;
        return true;
      },
      getToken: () async {
        tokenReads++;
        return 'token-1';
      },
      tokenRefresh: tokenRefresh.stream,
      registerDeviceToken: (strategyId, token) async {
        registrations.add('$strategyId:$token');
      },
      onError: errors.add,
    );

    final firstStrategies = [
      strategy('strategy-a', 'RELIANCE'),
      strategy('strategy-b', 'JSWSTEEL'),
      strategy('inactive', 'SBICARD', active: false),
    ];
    await service.syncStrategies(firstStrategies);
    expect(registrations, ['strategy-a:token-1', 'strategy-b:token-1']);

    await service.syncStrategies([
      ...firstStrategies,
      strategy('strategy-c', 'BHARTIARTL'),
    ]);
    expect(registrations.last, 'strategy-c:token-1');

    tokenRefresh.add('token-2');
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(
      registrations.skip(3),
      [
        'strategy-a:token-2',
        'strategy-b:token-2',
        'strategy-c:token-2',
      ],
    );
    expect(permissionRequests, 1);
    expect(tokenReads, 1);
    expect(errors, isEmpty);

    await service.dispose();
    await tokenRefresh.close();
  });

  test(
      'does not read or register a token when notification permission is denied',
      () async {
    final tokenRefresh = StreamController<String>.broadcast();
    final register = <String>[];
    var tokenReads = 0;
    final service = NotificationRegistrationService(
      requestPermission: () async => false,
      getToken: () async {
        tokenReads++;
        return 'token-1';
      },
      tokenRefresh: tokenRefresh.stream,
      registerDeviceToken: (strategyId, token) async {
        register.add('$strategyId:$token');
      },
    );

    await service.syncStrategies([strategy('strategy-a', 'RELIANCE')]);

    expect(tokenReads, 0);
    expect(register, isEmpty);

    await service.dispose();
    await tokenRefresh.close();
  });

  test('retries a failed strategy registration on the next sync', () async {
    final tokenRefresh = StreamController<String>.broadcast();
    final attempts = <String, int>{};
    final service = NotificationRegistrationService(
      requestPermission: () async => true,
      getToken: () async => 'token-1',
      tokenRefresh: tokenRefresh.stream,
      registerDeviceToken: (strategyId, token) async {
        attempts.update(strategyId, (count) => count + 1, ifAbsent: () => 1);
        if (strategyId == 'strategy-a' && attempts[strategyId] == 1) {
          throw Exception('temporary API error');
        }
      },
      onError: (_) {},
    );
    final strategies = [strategy('strategy-a', 'RELIANCE')];

    await service.syncStrategies(strategies);
    await service.syncStrategies(strategies);

    expect(attempts['strategy-a'], 2);

    await service.dispose();
    await tokenRefresh.close();
  });
}
