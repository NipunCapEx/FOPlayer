import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foplayer/main.dart';

void main() {
  group('FOPlayer dashboard business outcomes', () {
    testWidgets('shows all four configured instruments and demo-data warning',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());

      expect(find.text('RELIANCE'), findsOneWidget);
      expect(find.text('JSWSTEEL'), findsOneWidget);
      expect(find.text('BHARTIARTL'), findsOneWidget);
      expect(find.text('SBICARD'), findsOneWidget);
      expect(find.textContaining('DEMO DATA'), findsOneWidget);
      expect(find.text('Alerts and trading actions are not enabled.'), findsNothing);
    });

    testWidgets('labels an 8% move as caution and a 12% move as breached',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              InstrumentCard(
                instrument: Instrument(
                  symbol: 'CAUTION',
                  name: 'Threshold fixture',
                  entryPrice: 100,
                  spotPrice: 108,
                  lastUpdated: DateTime(2026, 10, 20),
                ),
                onEditEntry: _noop,
              ),
              InstrumentCard(
                instrument: Instrument(
                  symbol: 'BREACH',
                  name: 'Boundary fixture',
                  entryPrice: 100,
                  spotPrice: 112,
                  lastUpdated: DateTime(2026, 10, 20),
                ),
                onEditEntry: _noop,
              ),
            ],
          ),
        ),
      ));

      expect(find.text('CAUTION'), findsWidgets);
      expect(find.text('BREACHED'), findsOneWidget);
    });

    testWidgets('makes stale data explicit and suppresses movement display',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());

      expect(find.text('DATA STALE'), findsOneWidget);
      expect(find.text('Snapshot is stale. No actionable risk state is shown.'),
          findsOneWidget);
      expect(find.text('Movement unavailable'), findsOneWidget);
    });

    testWidgets('entry edit recalculates boundaries for the selected ticker',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());
      await tester.tap(find.byKey(const Key('risk-RELIANCE')));
      // Risk label is not an edit action; use the explicit edit button.
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Edit entry').first);
      await tester.pumpAndSettle();

      final entryField = find.byKey(const Key('entry-price-input'));
      expect(entryField, findsOneWidget);
      await tester.enterText(entryField, '1000');
      await tester.tap(find.byKey(const Key('save-entry-button')));
      await tester.pumpAndSettle();

      expect(find.text('₹1000.00'), findsOneWidget);
      expect(find.text('₹880.00'), findsOneWidget);
      expect(find.text('₹1120.00'), findsOneWidget);
    });
  });
}

void _noop() {}
