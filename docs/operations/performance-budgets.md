# Dashboard Performance Budgets

Launch targets to keep the dashboard steady during incident review. Tighten them once real production traces exist.

| Interaction | Budget |
| --- | --- |
| First authenticated load | Frame and inbox skeleton visible within 1.5 s on a laptop-class browser |
| Switching investigations | Shell, header, tabs and inspector stay in place; header updates within 500 ms of inbox data |
| Report render | Summary or a fixed loading panel within 750 ms of the fetch starting |
| Opening the evidence inspector | Tool call or customer-facing error within 750 ms of a citation click |
| SSE reconnect | "Reconnecting" state within 1 s, with existing events kept |

## Layout stability

- Inbox rows have a fixed minimum height.
- Header, tab bar, empty and loading panels, and the inspector keep stable dimensions across refreshes.
- Refresh keeps the selected investigation, tab, search and filters if the investigation still exists.
- Tablet widths may hide the inspector, but the report and evidence tabs stay reachable.
