# Code Warrior

A browser-based app that teaches complete beginners the basics of Python. Students work through short lessons, take on coding challenges, and run real Python right in the page, with nothing to install.

## Features

- **9 lessons**: printing, variables, math, strings, if/else, loops, lists, functions and dictionaries. Every code example can be edited and run, and each lesson ends with an exercise.
- **13 challenges**: Easy, Medium and Hard problems, from Battle Cry and FizzBuzz to Palindrome Guard, checked automatically.
- **"I'm stuck" hints**: up to three hints per problem, then the solution. Each hint lowers the XP reward a little, and hints can be closed with the × button.
- **Progress tracking**: XP, eight ranks from Recruit to Code Warrior, progress bars and badges.
- **Daily streak**: a 7-day streak bar, your best streak, and streak milestones.
- **Beginner-friendly errors**: plain-language tips for common Python errors, plus an expected-vs-actual comparison when output doesn't match.

## Running it

Open `index.html` in any modern browser. Python runs in the page through [Skulpt](https://skulpt.org/), which loads from a CDN, so you need an internet connection.

When the app runs on its own like this, progress and streaks are saved in the browser's local storage. Opened as a Claude artifact, it can also save progress to the student's account and turn on the AI "Code Coach" hint button.

### Hosting on GitHub Pages

1. In this repository, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. After a minute, the app is live at `https://<your-username>.github.io/code-warrior/`.

## Project structure

Everything lives in a single file, `index.html`: styles, lesson and challenge content, the code editor and the app logic. To add a lesson or challenge, add an entry to the `LESSONS` or `CHALLENGES` array in the script.
