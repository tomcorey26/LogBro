Overall

- Create a design document for the patterns you want followed for nextjs projects. use speech islands as a reference
- Put logic into pure functions when you can so that they can be tested
- Alwasy make sure the user understands what you are doing
- always write a test before you start. End to end and unit
- always run tests after your done so you dindt break any thing
- always split new work into a worktree or branch outside of git
- Follow engineering best practices for performant and seucre software
- Write tests that test behavior over implementation details
- PUsh back againstome if I tell you think is wrong
- Avoid using third party dependcies if you can
- Use haptic feedback whenever you can
- Mobile first, keep api layer seperate so can easily have web and mobile app
- Write tight specs so that the AI does what you want, use tests for this

React

- Use the react compiler, since we are using the compiler. Dont use useCallback
  or useMemo

Database

- Always put database query logic inside of a function
- Always keep business logic outside of the database functions to keep it reusable and organized
- Use transactions for atomicitiy, be weary of concurrency race conditions

API endpoints
Todo:

- Input is sanitized via zod
- Error handling is correct with correct response codes
- Security with rate limiting

Testing

- Write tests. Not too many. Mostly integration. https://kentcdodds.com/blog/write-tests
- E2E tests with Playwright
- Unit/Integration tests with RTL
- Api route testing with???
- How to keep tests determinisitc

- After completeing a PR, always add what was learned here

Devops setup

- DB
- Have persistent volume setup for SQL lite, so that on redeploy our db file does not get lost
- Locally (you, the developer): change schema → npm run db:generate → commit the migration files
- Prod (Coolify): drizzle-kit migrate runs the migration files at startup
- Use one coolify instance with another server that has your apps
- Use DB transactions in any places necessary to keep things atomic, and avoid data being in
broken partial state

UI

- Utilize shadcn, and some kind of reusable component library template (shipfast?) for spinning up apps quick
- Utilize truncation and character limits to prevent user from inputing long names and breaking layout
- Paginate long lists of items
- Make sure there is a 404 not found page
- Make sure the app has an icon

README
- Keep the README up to date