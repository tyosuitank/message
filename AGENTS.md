# AGENTS.md

This document outlines the current state and data architecture of the “Bubble Memo App.”

## Purpose

A thought reflection tool to capture what you were thinking yesterday, and plan what you're thinking today. Ideas evolve from **Seed → Branch → Tree**, following a plant-based metaphor.

## Glossary

| Term   | Meaning                            | Notes                                      |
| ------ | ---------------------------------- | ------------------------------------------ |
| Seed   | A single recorded thought          | Includes date, call count, and comments    |
| Leaf   | A comment or sub-thought of a Seed | Recorded via modal popup                   |
| Branch | A manual grouping of similar Seeds | Created in a dedicated branch editor page  |
| Tree   | A promoted Seed or Branch          | Becomes a "Tree" based on usage conditions |

## Storage

* **IndexedDB**

  * `thoughts`: Stores Seed objects by date (v2+ supports metadata like call count, appeared dates, comments)
  * `branches`: Stores Branches as selected groups of Seeds

* **localStorage**

  * `comments`: Legacy Leaf storage
  * `last-open-date`: Used for carryover logic at app start

## Implemented Features

* Thought registration, editing, and deletion (Seed)
* Comment (Leaf) addition and deletion per thought
* IndexedDB-backed storage and data migration (v1 → v2)
* Carryover modal for yesterday's thoughts
* Search bar to suggest reusable thoughts from past Seeds
* Call counter increments when Seeds are reused
* JSON export/import of full IndexedDB and Leaf data
* `branch.html`: Dedicated page to form Branches
* Responsive UI, modals, and mobile-first layout

## Upcoming Features

* Grouping of same text entries (e.g. “Grandma’s House (2x)”)
* Browsable Branch index
* Tree promotion logic (e.g. 30+ calls or 50+ Leaves)
* Visual indicator or label for Trees
* Better metadata aggregation for insight (e.g. trending Seeds)

---

This document will be updated as the app evolves.
