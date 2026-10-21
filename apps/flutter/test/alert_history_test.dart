import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foplayer/alert_history.dart';
import 'package:foplayer/strategy_api.dart';

void main() {
  testWidgets('shows alert details and delivery status', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AlertHistoryScreen(
          loadAlerts: () async => [
            UserAlert(
              id: 'alert-1',
              symbol: 'RELIANCE',
              kind: 'critical',
              message: 'RELIANCE critical: movement +10.25% from entry.',
              price: 1512,
              movementPercent: 10.25,
              createdAt: DateTime(2026, 10, 20, 12, 30),
              status: 'delivered',
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('RELIANCE · CRITICAL'), findsOneWidget);
    expect(find.text('RELIANCE critical: movement +10.25% from entry.'),
        findsOneWidget);
    expect(find.text('Price: ₹1512.00'), findsOneWidget);
    expect(find.text('Movement: +10.25%'), findsOneWidget);
    expect(find.text('DELIVERED'), findsOneWidget);
    expect(find.text('2026-10-20 12:30'), findsOneWidget);
  });

  testWidgets('filters alerts by symbol and delivery status', (tester) async {
    UserAlert makeAlert({
      required String id,
      required String symbol,
      required String kind,
      required String status,
    }) =>
        UserAlert(
          id: id,
          symbol: symbol,
          kind: kind,
          message: '$symbol $kind alert',
          price: 1000,
          movementPercent: 8,
          createdAt: DateTime(2026, 10, 20, 12),
          status: status,
        );

    await tester.pumpWidget(
      MaterialApp(
        home: AlertHistoryScreen(
          loadAlerts: () async => [
            makeAlert(
              id: '1',
              symbol: 'RELIANCE',
              kind: 'critical',
              status: 'delivered',
            ),
            makeAlert(
              id: '2',
              symbol: 'SBICARD',
              kind: 'caution',
              status: 'suppressed',
            ),
            makeAlert(
              id: '3',
              symbol: 'BHARTIARTL',
              kind: 'breached',
              status: 'pending',
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('RELIANCE · CRITICAL'), findsOneWidget);
    expect(find.text('SBICARD · CAUTION'), findsOneWidget);
    expect(find.text('BHARTIARTL · BREACHED'), findsOneWidget);

    await tester.tap(find.byKey(const Key('alert-symbol-filter')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SBICARD').last);
    await tester.pumpAndSettle();

    expect(find.text('SBICARD · CAUTION'), findsOneWidget);
    expect(find.text('RELIANCE · CRITICAL'), findsNothing);
    expect(find.text('BHARTIARTL · BREACHED'), findsNothing);

    await tester.tap(find.byKey(const Key('alert-status-filter')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SUPPRESSED').last);
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.notifications_off_outlined), findsOneWidget);
    expect(find.text('SUPPRESSED'), findsOneWidget);

    await tester.tap(find.byKey(const Key('clear-alert-filters-button')));
    await tester.pumpAndSettle();
    expect(find.text('RELIANCE · CRITICAL'), findsOneWidget);
    expect(find.text('BHARTIARTL · BREACHED'), findsOneWidget);
  });

  testWidgets('shows an empty state when no alerts exist', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AlertHistoryScreen(loadAlerts: () async => const []),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No alerts yet'), findsOneWidget);
    expect(find.byKey(const Key('alert-history-list')), findsNothing);
  });

  testWidgets('shows retry when alert history fails to load', (tester) async {
    var attempts = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: AlertHistoryScreen(
          loadAlerts: () async {
            attempts++;
            if (attempts == 1) throw Exception('network unavailable');
            return const [];
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Could not load alert history'), findsOneWidget);
    await tester.tap(find.byKey(const Key('retry-alert-history-button')));
    await tester.pumpAndSettle();

    expect(attempts, 2);
    expect(find.text('No alerts yet'), findsOneWidget);
  });
}
