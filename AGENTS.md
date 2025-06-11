# AGENTS.md

## 🎯 App Purpose
This is a personal thought-recording app for a single iPhone user (me).  
The goal is to:
- Write down what I'm thinking today
- Review what I was thinking yesterday
- Carry over ongoing thoughts to the next day
- See past thoughts grouped by date (in a simple, scrollable format)

I use this app every morning on Safari.

---

## 🎛️ Design Preferences
- The app should feel lightweight and simple
- No user login is needed
- It should be offline-friendly
- I like the current bubble-style UI, please keep it

---

## 🤖 AI Agent Instructions
- You may improve, clean up, or refactor code as needed
- Please preserve:
  - The structure of `Message.html` and `history.html`
  - Existing functionality (carry-over, comment modal, history)
- Use `IndexedDB` (not localStorage) to store data
- Add features like export/import, search, or tagging if useful

Be creative if you think of something helpful—but don’t break the current experience.  
Assume this is a personal tool, not a public-facing app.

---

## 📂 File Overview
- `Message.html`: Main input and view for today's thoughts
- `history.html`: Read-only scrollable list of past thoughts
- `AGENTS.md`: You're reading it!