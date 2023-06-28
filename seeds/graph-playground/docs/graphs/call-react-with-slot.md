# call-react-with-slot
---

```mermaid
graph TD;
ask[/"input
id='ask'"/]:::input -- text:text --> react[["include
id='react'"]]:::include
react[["include
id='react'"]]:::include -- text:text --> print{{"output
id='print'"}}:::output
tools-in["slot-input
id='tools-in'"] -- search:text --> search[["include
id='search'"]]:::include
tools-in["slot-input
id='tools-in'"] -- math:text --> math[["include
id='math'"]]:::include
math[["include
id='math'"]]:::include -- text:Observation --> tools-out["slot-output
id='tools-out'"]
search[["include
id='search'"]]:::include -- text:Observation --> tools-out["slot-output
id='tools-out'"]
```