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

    testWidgets('labels both ±12% boundaries as breached', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
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
                      symbol: 'UPPER-BREACH',
                      name: 'Upper boundary fixture',
                      entryPrice: 100,
                      spotPrice: 112,
                      lastUpdated: DateTime(2026, 10, 20),
                    ),
                    onEditEntry: _noop,
                  ),
                  InstrumentCard(
                    instrument: Instrument(
                      symbol: 'LOWER-BREACH',
                      name: 'Lower boundary fixture',
                      entryPrice: 100,
                      spotPrice: 88,
                      lastUpdated: DateTime(2026, 10, 20),
                    ),
                    onEditEntry: _noop,
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.text('CAUTION'), findsWidgets);
      expect(find.text('BREACHED'), findsNWidgets(2));
    });

    testWidgets('makes stale data explicit and suppresses movement display',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());

      expect(find.text('DATA STALE'), findsOneWidget);
      expect(
        find.text('Snapshot is stale. No actionable risk state is shown.'),
        findsOneWidget,
      );
      expect(find.text('Movement unavailable'), findsOneWidget);
    });

    testWidgets('entry edit recalculates boundaries for the selected ticker',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());
      final editButton = find.widgetWithText(TextButton, 'Edit entry').first;
      await tester.ensureVisible(editButton);
      await tester.pumpAndSettle();
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
      await tester.pumpAndSettle();
      await tester.tap(editButton);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('entry-price-input')), '0');
      await tester.tap(find.byKey(const Key('save-entry-button')));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid positive entry price.'), findsOneWidget);
      expect(find.text('₹1400.00'), findsOneWidget);
    });

    testWidgets('adds a supported symbol with a positive entry price',
        (tester) async {
      await tester.pumpWidget(const FOPlayerApp());
      await tester.tap(find.byKey(const Key('add-instrument-button')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('new-entry-price-input')),
        '1234.5',
      );
      await tester.tap(find.byKey(const Key('save-new-symbol-button')));
      await tester.pumpAndSettle();

      expect(find.text('TCS'), findsOneWidget);
      expect(find.textContaining('DEMO DATA'), findsOneWidget);
    });

    testWidgets('rejects invalid entry when adding a symbol', (tester) async {
      await tester.pumpWidget(const FOPlayerApp());
      await tester.tap(find.byKey(const Key('add-instrument-button')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('new-entry-price-input')), '0');
      await tester.tap(find.byKey(const Key('save-new-symbol-button')));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid positive entry price.'), findsOneWidget);
      expect(find.byKey(const Key('new-entry-price-input')), findsOneWidget);
    });

    testWidgets('removes a symbol from the active watchlist', (tester) async {
      await tester.pumpWidget(const FOPlayerApp());
      final removeButton = find.byKey(const Key('remove-SBICARD'));
      await tester.ensureVisible(removeButton);
      await tester.tap(removeButton);
      await tester.pumpAndSettle();

      expect(find.text('SBICARD'), findsNothing);
      expect(find.text('SBICARD removed from this dashboard.'), findsOneWidget);
    });
  });
}

void _noop() {}
