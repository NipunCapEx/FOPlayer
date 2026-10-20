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
      expect(
        find.textContaining('Alerts and trading actions are not enabled.'),
        findsOneWidget,
      );
    });

    testWidgets('labels an 8% move as caution and a 12% move as breached',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ListView(
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
      final editButton = find.widgetWithText(TextButton, 'Edit entry').first;
      await tester.ensureVisible(editButton);
      await tester.tap(editButton);
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
    test('uses the critical level at exactly 10% in either direction', () {
      for (final spot in [110.0, 90.0]) {
        final instrument = Instrument(
          symbol: 'TEST',
          name: 'Threshold fixture',
          entryPrice: 100,
          spotPrice: spot,
          lastUpdated: DateTime(2026, 10, 20),
        );
        expect(instrument.riskLevel, RiskLevel.critical);
      }
    });

    testWidgets('rejects non-positive entry values at the dialog boundary',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());
      final editButton = find.widgetWithText(TextButton, 'Edit entry').first;
      await tester.ensureVisible(editButton);
      await tester.tap(editButton);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('entry-price-input')), '0');
      await tester.tap(find.byKey(const Key('save-entry-button')));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid positive entry price.'), findsOneWidget);
      expect(find.text('₹1232.00'), findsOneWidget);
    });
  });
}

void _noop() {}
