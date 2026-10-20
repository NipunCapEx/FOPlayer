import 'package:flutter/material.dart';
import 'strategy_api.dart';

class AlertHistoryScreen extends StatefulWidget {
  const AlertHistoryScreen({required this.loadAlerts, super.key});

  final Future<List<UserAlert>> Function() loadAlerts;

  @override
  State<AlertHistoryScreen> createState() => _AlertHistoryScreenState();
}

class _AlertHistoryScreenState extends State<AlertHistoryScreen> {
  List<UserAlert> _alerts = const [];
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final alerts = await widget.loadAlerts();
      if (!mounted) return;
      setState(() {
        _alerts = alerts;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alert history'),
        actions: [
          IconButton(
            key: const Key('refresh-alert-history-button'),
            tooltip: 'Refresh alert history',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError(context)
              : _alerts.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.notifications_none, size: 48),
                            SizedBox(height: 12),
                            Text(
                              'No alerts yet',
                              style: TextStyle(fontSize: 18),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Risk alerts for your strategies will appear here '
                              'when the monitoring service records them.',
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        key: const Key('alert-history-list'),
                        padding: const EdgeInsets.all(16),
                        itemCount: _alerts.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) =>
                            _AlertHistoryCard(alert: _alerts[index]),
                      ),
                    ),
    );
  }

  Widget _buildError(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Could not load alert history',
              style: TextStyle(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              'Check your connection and try again. $_error',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('retry-alert-history-button'),
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertHistoryCard extends StatelessWidget {
  const _AlertHistoryCard({required this.alert});

  final UserAlert alert;

  @override
  Widget build(BuildContext context) {
    final kind = alert.kind.replaceAll('-', ' ').toUpperCase();
    final timestamp =
        alert.createdAt?.toString().substring(0, 16) ?? 'Time unavailable';
    final status = alert.status.toLowerCase();
    final icon = switch (status) {
      'delivered' => Icons.check_circle_outline,
      'pending' => Icons.schedule,
      _ => Icons.info_outline,
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${alert.symbol} · $kind',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Icon(icon, size: 18),
                const SizedBox(width: 4),
                Text(status.toUpperCase()),
              ],
            ),
            const SizedBox(height: 8),
            Text(alert.message),
            const SizedBox(height: 8),
            Wrap(
              spacing: 16,
              runSpacing: 6,
              children: [
                Text('Price: ₹${alert.price.toStringAsFixed(2)}'),
                Text(
                  'Movement: ${alert.movementPercent >= 0 ? '+' : ''}'
                  '${alert.movementPercent.toStringAsFixed(2)}%',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              timestamp,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
