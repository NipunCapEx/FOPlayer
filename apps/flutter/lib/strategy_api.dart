import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

class UserStrategy {
  const UserStrategy({
    required this.id,
    required this.symbol,
    required this.entryPrice,
    required this.active,
  });

  final String id;
  final String symbol;
  final double entryPrice;
  final bool active;

  factory UserStrategy.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final symbol = json['symbol'];
    final entryPrice = json['entryPrice'];
    final active = json['active'];
    if (id is! String ||
        symbol is! String ||
        entryPrice is! num ||
        active is! bool) {
      throw const FormatException('Invalid strategy returned by the API.');
    }
    return UserStrategy(
      id: id,
      symbol: symbol,
      entryPrice: entryPrice.toDouble(),
      active: active,
    );
  }
}

class StrategyApiException implements Exception {
  const StrategyApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class StrategyApiClient {
  StrategyApiClient({
    FirebaseAuth? auth,
    http.Client? client,
    String? baseUrl,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _client = client ?? http.Client(),
        _baseUrl = (baseUrl ?? const String.fromEnvironment(
          'FOPLAYER_API_BASE_URL',
        )).trim().replaceFirst(RegExp(r'/+$'), '');

  final FirebaseAuth _auth;
  final http.Client _client;
  final String _baseUrl;

  bool get isConfigured => _baseUrl.startsWith('https://');

  Future<List<UserStrategy>> listStrategies() async {
    final response = await _request('GET', '/api/strategies');
    if (response is! List) {
      throw const StrategyApiException('Unexpected strategies response.');
    }
    return response
        .map((value) {
          if (value is! Map<String, dynamic>) {
            throw const FormatException('Invalid strategy response item.');
          }
          return UserStrategy.fromJson(value);
        })
        .where((strategy) => strategy.active)
        .toList();
  }

  Future<UserStrategy> createStrategy({
    required String symbol,
    required double entryPrice,
  }) async {
    final response = await _request('POST', '/api/strategies', body: {
      'symbol': symbol,
      'entryPrice': entryPrice,
    });
    if (response is! Map<String, dynamic>) {
      throw const StrategyApiException('Unexpected create response.');
    }
    return UserStrategy.fromJson(response);
  }

  Future<UserStrategy> updateStrategy(
    String id, {
    double? entryPrice,
    bool? active,
  }) async {
    final body = <String, dynamic>{};
    if (entryPrice != null) body['entryPrice'] = entryPrice;
    if (active != null) body['active'] = active;
    final response = await _request(
      'PATCH',
      '/api/strategies/${Uri.encodeComponent(id)}',
      body: body,
    );
    if (response is! Map<String, dynamic>) {
      throw const StrategyApiException('Unexpected update response.');
    }
    return UserStrategy.fromJson(response);
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    if (!isConfigured) {
      throw const StrategyApiException(
        'Configure FOPLAYER_API_BASE_URL with the deployed HTTPS API URL.',
      );
    }
    final user = _auth.currentUser;
    if (user == null) {
      throw const StrategyApiException('Sign in before managing your watchlist.');
    }
    final token = await user.getIdToken();
    final uri = Uri.parse('$_baseUrl$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    };
    if (body != null) headers['Content-Type'] = 'application/json';

    late http.Response response;
    switch (method) {
      case 'GET':
        response = await _client.get(uri, headers: headers);
      case 'POST':
        response = await _client.post(
          uri,
          headers: headers,
          body: jsonEncode(body),
        );
      case 'PATCH':
        response = await _client.patch(
          uri,
          headers: headers,
          body: jsonEncode(body),
        );
      default:
        throw ArgumentError.value(method, 'method', 'Unsupported HTTP method');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = response.body.length > 300
          ? response.body.substring(0, 300)
          : response.body;
      throw StrategyApiException(
        'Watchlist request failed (${response.statusCode}): $message',
      );
    }
    if (response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }
}
