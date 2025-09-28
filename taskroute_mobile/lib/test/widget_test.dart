import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:taskroute_mobile/main.dart';

void main() {
  testWidgets('TaskRoute app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const TaskRouteApp());

    // Verify that the login screen is displayed
    expect(find.text('TaskRoute Mobile'), findsOneWidget);
    expect(find.text('Field Task Management'), findsOneWidget);
  });
}