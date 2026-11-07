Task: write the task list of ONE project as JSON (the tool renders the file, assigns the ids and the statuses). The project
template already provides: the scaffold, the gate, the config loader, and a sample feature `items`; the tool adds those rows and a
final end-to-end row. Do NOT write them. Your first feature task replaces the sample `items` feature with the first real aggregate.
- Tasks are small: half a day of agent work or less, one clear result each, ordered so that every task builds on earlier ones.
  Between 12 and 45 tasks, depending on the size of the PRD. `stage` groups consecutive tasks (a short name; stages follow the PRD).
- `key` is a short unique label (t01, t02 ...). `needs` lists the keys of EARLIER tasks of this project, and, for a client project,
  the ids (e.g. SRV-012) of tasks of the server project listed in the input that provide the operations the task calls. A task that
  calls an operation must need the server task that builds it; if no listed server task builds it, say so in `reads` instead of inventing an id.
- `slug` is an English kebab-case word group for the branch name (max 5 words). `title` and `reads` are in the document language.
  `reads` names exactly what to read: `PRD S07, F02; BUSINESS_DOMAIN §5.6; ops: postBookings, getSlots`.
- Server project: schemas and settings first, then auth, then each aggregate (model → service → routes → tests → OpenAPI),
  jobs, notifications, and what the client PRDs need. Client project: data layer from the contract with mock fixtures, then one task
  per screen or small group of screens in PRD order, then flows and polish.
- `owner_questions`: ids of the open questions in the input that this project cannot finish without. A task that cannot start until
  the owner answers one has `waits_for` set to that id (else empty). Do not invent a question.
