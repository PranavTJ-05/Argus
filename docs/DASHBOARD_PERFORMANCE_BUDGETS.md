# Dashboard Performance Budgets

These budgets protect the customer-facing dashboard from feeling unstable during normal incident
review. They are launch targets for Phase 29 and should be tightened after real production traces
exist.

## Budgets

- First authenticated dashboard load: show the dashboard frame and inbox loading skeleton within
  1.5 seconds on a laptop-class browser.
- Investigation switch: preserve the shell, header, tabs, and inspector layout while new artifacts
  load; the selected investigation header should update within 500 ms after inbox data is available.
- Report render: render the customer summary or a fixed loading panel within 750 ms after report
  fetch starts.
- Evidence inspector open: show the selected tool call or customer-facing evidence error within
  750 ms after a citation click.
- SSE reconnect: show a reconnecting state within 1 second and avoid clearing existing events while
  the stream reconnects.

## Layout Stability Rules

- Inbox rows reserve a fixed minimum height.
- The investigation header, tab bar, empty panels, loading panels, and evidence inspector keep
  stable dimensions during refreshes.
- Refresh must preserve selected investigation, active tab, search, and filter state when the
  selected investigation still exists.
- Tablet layout may hide the evidence inspector, but the report and evidence tabs must remain
  reachable.
