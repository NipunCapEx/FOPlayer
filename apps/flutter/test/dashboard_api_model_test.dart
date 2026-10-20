import 'package:flutter_test/flutter_test.dart';
import 'package:foplayer/strategy_api.dart';

void main() {
  group('UserDashboard', () {
    test('parses strategy snapshots and validates freshness', () {
      final dashboard = UserDashboard.fromJson({
        'strategies': [
          {
            'id': 'strategy-1',
            'symbol': 'RELIANCE',
            'entryPrice': 1000,
            'active': true,
          },
        ],
        'snapshots': [
          {
            'strategyId': 'strategy-1',
            'assessment': {
              'symbol': 'RELIANCE',
              'entryPrice': 1000,
              'spotPrice': 1080,
              'movementPercent': 8,
              'level': 'caution',
            },
            'source': 'Yahoo Finance',
            'exchangeTimestamp': '2026-10-20T12:00:00Z',
            'fetchedAt': '2026-10-20T12:00:00Z',
            'recordedAt': '2026-10-20T12:00:01Z',
          },
        ],
        'alerts': [],
      });

      expect(dashboard.hasAnyStrategies, isTrue);
      expect(dashboard.strategies, hasLength(1));
      final snapshot = dashboard.snapshots['strategy-1']!;
      expect(snapshot.symbol, 'RELIANCE');
      expect(snapshot.spotPrice, 1080);
      expect(snapshot.source, 'Yahoo Finance');
      expect(
        snapshot.isFreshAt(DateTime.parse('2026-10-20T12:05:00Z').toLocal()),
        isTrue,
      );
      expect(
        snapshot.isFreshAt(DateTime.parse('2026-10-20T12:11:00Z').toLocal()),
        isFalse,
      );
    });

    test('does not treat an all-inactive watchlist as a new account', () {
      final dashboard = UserDashboard.fromJson({
        'strategies': [
          {
            'id': 'inactive-1',
            'symbol': 'RELIANCE',
            'entryPrice': 1000,
            'active': false,
          },
        ],
        'snapshots': [],
        'alerts': [],
      });

      expect(dashboard.hasAnyStrategies, isTrue);
      expect(dashboard.strategies, isEmpty);
    });

    test('rejects invalid market prices in a dashboard snapshot', () {
      expect(
        () => DashboardSnapshot.fromJson({
          'strategyId': 'strategy-1',
          'assessment': {
            'symbol': 'RELIANCE',
            'entryPrice': 1000,
            'spotPrice': double.nan,
            'movementPercent': 0,
            'level': 'normal',
          },
          'source': 'Yahoo Finance',
          'exchangeTimestamp': '2026-10-20T12:00:00Z',
          'fetchedAt': '2026-10-20T12:00:00Z',
          'recordedAt': '2026-10-20T12:00:01Z',
        }),
        throwsFormatException,
      );
    });
  });
}
