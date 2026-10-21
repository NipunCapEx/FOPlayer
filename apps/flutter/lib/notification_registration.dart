import 'dart:async';

import 'package:foplayer/strategy_api.dart';

typedef NotificationPermissionRequest = Future<bool> Function();
typedef MessagingTokenGetter = Future<String?> Function();
typedef DeviceTokenRegistrar = Future<void> Function(
  String strategyId,
  String token,
);

class NotificationRegistrationService {
  NotificationRegistrationService({
    required this.requestPermission,
    required this.getToken,
    required this.tokenRefresh,
    required this.registerDeviceToken,
    this.onError,
  });

  final NotificationPermissionRequest requestPermission;
  final MessagingTokenGetter getToken;
  final Stream<String> tokenRefresh;
  final DeviceTokenRegistrar registerDeviceToken;
  final void Function(Object error)? onError;

  StreamSubscription<String>? _tokenSubscription;
  List<UserStrategy> _strategies = const [];
  final Set<String> _registeredStrategyIds = {};
  String? _currentToken;
  bool _started = false;
  bool _permissionGranted = false;

  Future<void> syncStrategies(List<UserStrategy> strategies) async {
    _strategies = strategies.where((strategy) => strategy.active).toList();

    if (!_started) {
      _started = true;
      try {
        _permissionGranted = await requestPermission();
        if (!_permissionGranted) return;
        _tokenSubscription = tokenRefresh.listen(
          (token) => unawaited(_registerToken(token)),
          onError: (Object error, StackTrace stackTrace) => onError?.call(error),
        );
      } catch (error) {
        onError?.call(error);
        return;
      }
    }

    if (!_permissionGranted) return;
    try {
      final token = _currentToken ?? await getToken();
      if (token != null) await _registerToken(token);
    } catch (error) {
      onError?.call(error);
    }
  }

  Future<void> _registerToken(String token) async {
    if (token.trim().isEmpty) return;
    if (_currentToken != token) {
      _currentToken = token;
      _registeredStrategyIds.clear();
    }

    for (final strategy in _strategies) {
      if (_registeredStrategyIds.contains(strategy.id)) continue;
      try {
        await registerDeviceToken(strategy.id, token);
        _registeredStrategyIds.add(strategy.id);
      } catch (error) {
        onError?.call(error);
      }
    }
  }

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    _tokenSubscription = null;
  }
}
