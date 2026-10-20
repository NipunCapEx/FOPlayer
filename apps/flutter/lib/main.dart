import 'package:flutter/material.dart';

void main() {
  runApp(const FOPlayerApp());
}

enum RiskLevel { normal, caution, critical, breached }

class Instrument {
  const Instrument({
    required this.symbol,
    required this.name,
    required this.entryPrice,
    required this.spotPrice,
    required this.lastUpdated,
    this.isStale = false,
  });

  final String symbol;
  final String name;
  final double entryPrice;
  final double spotPrice;
  final DateTime lastUpdated;
  final bool isStale;

  double get lowerBoundary => entryPrice * 0.88;
  double get upperBoundary => entryPrice * 1.12;
  double get movementPercent => (spotPrice - entryPrice) / entryPrice * 100;

  RiskLevel get riskLevel {
    if (isStale) return RiskLevel.normal;
    // Use the entry-relative percentage for threshold comparisons to avoid
    // floating-point boundary rounding at exactly ±12%.
    if (movementPercent.abs() >= 12) return RiskLevel.breached;
    if (movementPercent.abs() >= 10) return RiskLevel.critical;
    if (movementPercent.abs() >= 8) return RiskLevel.caution;
    return RiskLevel.normal;
  }

  Instrument copyWith({double? entryPrice}) => Instrument(
        symbol: symbol,
        name: name,
        entryPrice: entryPrice ?? this.entryPrice,
        spotPrice: spotPrice,
        lastUpdated: lastUpdated,
        isStale: isStale,
      );
}

class FOPlayerApp extends StatelessWidget {
  const FOPlayerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FnO Players',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF175CD3)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late List<Instrument> instruments;

  @override
  void initState() {
    super.initState();
    // Explicitly labelled fixtures: the live provider/API is part of milestone 3.
    final now = DateTime(2026, 10, 20, 11, 0);
    instruments = [
      Instrument(
        symbol: 'RELIANCE',
        name: 'Reliance Industries',
        entryPrice: 1400,
        spotPrice: 1512,
        lastUpdated: now,
      ),
      Instrument(
        symbol: 'JSWSTEEL',
        name: 'JSW Steel',
        entryPrice: 1100,
        spotPrice: 1018,
        lastUpdated: now,
      ),
      Instrument(
        symbol: 'BHARTIARTL',
        name: 'Bharti Airtel',
        entryPrice: 1600,
        spotPrice: 1680,
        lastUpdated: now,
      ),
      Instrument(
        symbol: 'SBICARD',
        name: 'SBI Cards',
        entryPrice: 850,
        spotPrice: 850,
        lastUpdated: now,
        isStale: true,
      ),
    ];
  }

  static const _supportedSymbols = <String, String>{
    'RELIANCE': 'Reliance Industries',
    'JSWSTEEL': 'JSW Steel',
    'BHARTIARTL': 'Bharti Airtel',
    'SBICARD': 'SBI Cards',
    'TCS': 'Tata Consultancy Services',
    'INFY': 'Infosys',
    'HDFCBANK': 'HDFC Bank',
    'ICICIBANK': 'ICICI Bank',
  };

  Future<void> _addInstrument() async {
    final available = _supportedSymbols.keys
        .where((symbol) => !instruments.any((item) => item.symbol == symbol))
        .toList();
    if (available.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All supported demo symbols are already added.'),
        ),
      );
      return;
    }
    final result = await showDialog<Instrument>(
      context: context,
      builder: (dialogContext) => AddInstrumentDialog(
        symbols: available,
        names: _supportedSymbols,
      ),
    );
    if (result == null || !mounted) return;
    setState(() => instruments = [...instruments, result]);
  }

  void _removeInstrument(Instrument instrument) {
    setState(() {
      instruments = instruments
          .where((item) => item.symbol != instrument.symbol)
          .toList();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${instrument.symbol} removed from this dashboard.'),
      ),
    );
  }

  Future<void> _editEntry(Instrument instrument) async {
    final newEntry = await showDialog<double>(
      context: context,
      builder: (dialogContext) => EntryPriceDialog(instrument: instrument),
    );
    if (newEntry == null || !mounted) return;
    setState(() {
      instruments = [
        for (final item in instruments)
          if (item.symbol == instrument.symbol)
            item.copyWith(entryPrice: newEntry)
          else
            item,
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = instruments.where((i) => !i.isStale).length;
    final breachedCount = instruments
        .where((i) => !i.isStale && i.riskLevel == RiskLevel.breached)
        .length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('FnO Players'),
        actions: [
          const Padding(
            padding: EdgeInsets.only(right: 16),
            child: Center(
              child: Chip(
                avatar: Icon(Icons.science_outlined, size: 18),
                label: Text('Prototype'),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1200),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Hedging risk dashboard',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Monitor entry-relative movement and structural boundaries.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 16),
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'DEMO DATA — prices are illustrative fixtures, not live '
                            'market data. Alerts and trading actions are not enabled.',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _SummaryTile(
                      label: 'Tracked instruments',
                      value: '${instruments.length}',
                      icon: Icons.show_chart,
                    ),
                    _SummaryTile(
                      label: 'Valid demo snapshots',
                      value: '$activeCount',
                      icon: Icons.verified_outlined,
                    ),
                    _SummaryTile(
                      label: 'Boundary breaches',
                      value: '$breachedCount',
                      icon: Icons.warning_amber_rounded,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 850
                        ? 2
                        : constraints.maxWidth >= 560
                            ? 2
                            : 1;
                    final cardWidth =
                        (constraints.maxWidth - (columns - 1) * 14) / columns;
                    return Wrap(
                      spacing: 14,
                      runSpacing: 14,
                      children: [
                        for (final instrument in instruments)
                          SizedBox(
                            width: cardWidth,
                            child: InstrumentCard(
                              instrument: instrument,
                              onEditEntry: () => _editEntry(instrument),
                              onRemove: () => _removeInstrument(instrument),
                            ),
                          ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 24),
                Text(
                  'Risk thresholds',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                const Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _LegendChip(
                      label: '±8% Caution',
                      level: RiskLevel.caution,
                    ),
                    _LegendChip(
                      label: '±10% Critical',
                      level: RiskLevel.critical,
                    ),
                    _LegendChip(
                      label: '±12% Breached',
                      level: RiskLevel.breached,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  'Next: connect authenticated API, validated market snapshots, '
                  'expiry configuration, charts and alert history.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AddInstrumentDialog extends StatefulWidget {
  const AddInstrumentDialog({
    required this.symbols,
    required this.names,
    super.key,
  });

  final List<String> symbols;
  final Map<String, String> names;

  @override
  State<AddInstrumentDialog> createState() => _AddInstrumentDialogState();
}

class _AddInstrumentDialogState extends State<AddInstrumentDialog> {
  late String symbol;
  late final TextEditingController entryController;

  @override
  void initState() {
    super.initState();
    symbol = widget.symbols.first;
    entryController = TextEditingController();
  }

  @override
  void dispose() {
    entryController.dispose();
    super.dispose();
  }

  void _save() {
    final entry = double.tryParse(entryController.text.trim());
    if (entry == null || !entry.isFinite || entry <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid positive entry price.')),
      );
      return;
    }
    final now = DateTime.now();
    Navigator.of(context).pop(
      Instrument(
        symbol: symbol,
        name: widget.names[symbol]!,
        entryPrice: entry,
        // Until a live provider is configured, do not fabricate a market quote.
        spotPrice: entry,
        lastUpdated: now,
        isStale: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add watchlist symbol'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<String>(
            key: const Key('new-symbol-dropdown'),
            value: symbol,
            decoration: const InputDecoration(labelText: 'Symbol'),
            items: [
              for (final item in widget.symbols)
                DropdownMenuItem(value: item, child: Text(item)),
            ],
            onChanged: (value) {
              if (value != null) setState(() => symbol = value);
            },
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('new-entry-price-input'),
            controller: entryController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Entry price (₹)',
              hintText: 'Enter your entry price',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          key: const Key('save-new-symbol-button'),
          onPressed: _save,
          child: const Text('Add symbol'),
        ),
      ],
    );
  }
}

class EntryPriceDialog extends StatefulWidget {
  const EntryPriceDialog({required this.instrument, super.key});

  final Instrument instrument;

  @override
  State<EntryPriceDialog> createState() => _EntryPriceDialogState();
}

class _EntryPriceDialogState extends State<EntryPriceDialog> {
  late final TextEditingController controller;

  @override
  void initState() {
    super.initState();
    controller = TextEditingController(
      text: widget.instrument.entryPrice.toStringAsFixed(2),
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Edit ${widget.instrument.symbol} entry'),
      content: TextField(
        key: const Key('entry-price-input'),
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(
          labelText: 'Entry price (₹)',
          hintText: 'Enter a positive price',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          key: const Key('save-entry-button'),
          onPressed: () {
            final value = double.tryParse(controller.text.trim());
            if (value == null || !value.isFinite || value <= 0) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Enter a valid positive entry price.'),
                ),
              );
              return;
            }
            Navigator.pop(context, value);
          },
          child: const Text('Save entry'),
        ),
      ],
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(icon, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: Theme.of(context).textTheme.bodySmall),
                    Text(
                      value,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class InstrumentCard extends StatelessWidget {
  const InstrumentCard({
    required this.instrument,
    required this.onEditEntry,
    this.onRemove,
    super.key,
  });

  final Instrument instrument;
  final VoidCallback onEditEntry;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final level = instrument.riskLevel;
    final snapshotTime = instrument.lastUpdated.toString().substring(0, 16);
    final levelLabel = instrument.isStale
        ? 'DATA STALE'
        : switch (level) {
            RiskLevel.normal => 'NORMAL',
            RiskLevel.caution => 'CAUTION',
            RiskLevel.critical => 'CRITICAL',
            RiskLevel.breached => 'BREACHED',
          };
    final color = instrument.isStale
        ? Colors.blueGrey
        : switch (level) {
            RiskLevel.normal => Colors.green.shade700,
            RiskLevel.caution => Colors.orange.shade800,
            RiskLevel.critical => Colors.deepOrange.shade800,
            RiskLevel.breached => Colors.red.shade800,
          };

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        instrument.symbol,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(instrument.name),
                    ],
                  ),
                ),
                Container(
                  key: Key('risk-${instrument.symbol}'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    levelLabel,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Demo spot'),
                      Text(
                        '₹${instrument.spotPrice.toStringAsFixed(2)}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ],
                  ),
                ),
                Text(
                  instrument.isStale
                      ? 'Movement unavailable'
                      : '${instrument.movementPercent >= 0 ? '+' : ''}'
                          '${instrument.movementPercent.toStringAsFixed(2)}%',
                  style: TextStyle(
                    color: instrument.isStale ? Colors.blueGrey : color,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 28),
            _PriceRow(label: 'Entry', value: instrument.entryPrice),
            _PriceRow(
              label: 'Lower boundary (−12%)',
              value: instrument.lowerBoundary,
            ),
            _PriceRow(
              label: 'Upper boundary (+12%)',
              value: instrument.upperBoundary,
            ),
            const SizedBox(height: 10),
            if (instrument.isStale)
              const Text(
                'Snapshot is stale. No actionable risk state is shown.',
                key: Key('stale-message'),
              )
            else
              Text(
                'Snapshot time: $snapshotTime',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onEditEntry,
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Edit entry'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text('₹${value.toStringAsFixed(2)}'),
        ],
      ),
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.label, required this.level});

  final String label;
  final RiskLevel level;

  @override
  Widget build(BuildContext context) {
    final color = switch (level) {
      RiskLevel.normal => Colors.green,
      RiskLevel.caution => Colors.orange,
      RiskLevel.critical => Colors.deepOrange,
      RiskLevel.breached => Colors.red,
    };
    return Chip(
      avatar: CircleAvatar(backgroundColor: color, radius: 6),
      label: Text(label),
    );
  }
}
