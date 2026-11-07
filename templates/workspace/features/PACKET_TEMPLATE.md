# Feature: <feature>

> Two pages at most: this is all the workers get. Run `python3 scripts/line.py check <feature>`.

## Decisions
- What was decided with the owner, one line each. An open rule goes here as a question and stops the line.

## Contract
none
<!-- Or: the operations, fields and namespaces that change. The server worker fixes them first; every client builds on them. -->

## Design
none
<!-- Or: the Design artifact link and the changed screens. Workers build on the existing tokens and components. -->

## Docs
none
<!-- Or: which BUSINESS_DOMAIN, PRD and BRD sections change, and what they say now. One docs worker writes them after the merge. -->

## Module: server
Tasks: SRV-000
Read: the BUSINESS_DOMAIN sections and operations this part touches, and every file you already know it changes (a worker that has to search for them costs far more than this line)
- [ ] One criterion a reviewer can check against the diff

<!-- One ## Module: section per module that changes: server, admin, merchant, customer. Delete the rest. -->
