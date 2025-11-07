# TownPass Microservice Integration Checklist

## 1. Service Listing
- Provide the app team with the service metadata (icon asset, title, description, HTTPS URL) so it can be added to `MyServiceItem` in `lib/page/city_service/model/my_service_model.dart`.
- Ensure the page handles being opened in an in-app WebView and does not rely on unsupported browser APIs.

## 2. Flutter JS Bridge Baseline
- On page load, verify `window.flutterObject` exists before sending messages; all requests use:
  ```js
  window.flutterObject?.postMessage(JSON.stringify({ name, data }));
  ```
- Gracefully degrade when the bridge is unavailable (e.g., direct browser access).

## 3. Location (GPS)
- Request the current position:
  ```js
  window.flutterObject?.postMessage(JSON.stringify({ name: 'location', data: null }));
  ```
- Handle the response:
  - Success: `data` is a `Position` JSON with latitude, longitude, etc.
  - Failure/denied: `data` is `[]`; show UI guidance for enabling permissions or retrying.
- Account for repeated calls after users change permissions.

## 4. Notifications
- Trigger a local notification:
  ```js
  window.flutterObject?.postMessage(JSON.stringify({
    name: 'notify',
    data: { title: '提醒', content: '文字內容' }
  }));
  ```
- If `content` matches `已訂閱xxx` or `已取消訂閱xxx`, the app updates subscription status—ensure content strings follow this format when required.
- Detect and inform users when the OS has blocked notification permissions.

## 5. Error Handling & QA
- Add visible error states for any denied permissions or failed bridge calls.
- Document manual QA steps covering:
  - Opening the service via WebView.
  - Location permission request flow and data display.
  - Notification trigger and subscription text parsing.
- Share the checklist above with both the microservice and app teams before release.
