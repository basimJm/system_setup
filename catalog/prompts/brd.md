Task: write the BRD (business requirements) of ONE module: why it exists and what it must achieve. The PRD, written next, says how
it behaves and cites your ids.
- 1: goals with measurable success measures taken from the document (an unmeasured goal gets an `OPEN:` line).
- 3: a table `| ID | Requirement | Priority | Phase | PRD sections |` with ids B01, B02 ... (priority must/should/could, phase 1 or
  later); put `—` in the last column. One requirement per row, testable, citing `BUSINESS_DOMAIN §N` where a rule exists.
- 4: non-functional requirements; give a number only when the document does; otherwise a settings key plus an `OPEN:` line.
- 5: phases and what each defers. 6: dependencies on the other modules and on the SDKs/providers of the plan, each with the fake
  used until it is live. 7: open decisions of the owner, with the assumption in use (use the plan's open questions that affect this module).
