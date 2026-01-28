For all plans listed here, you will create sub agents for each task to conserve context. You are acting as a manager, making sure to move each agent along, and make sure that the tasks get completed fully, and to a production grade standard. Each task will be completed in four phases:

1. Planning phase: This agent should plan out in more detail what needs to happen. It should plan out what key components need to be built, how the files should be structured, what functionality exists and can be extended, and what needs to be created. It should make sure that it has a full understanding of the feature and what this feature may interact with, so that it can plan around those interactions. Essentially, it should create a detailed plan for the agents that will follow so that they can stick to a plan, and they can only be concerned with their primary task. It should not get too far into the technicalities of the plan (unless necessary), as each agent that follows will be specialized for a task, so it just has to create the outline, and the following agents will take care of the granular implementation details.
2. Design and UI phase: In the design phase, you will create a sub agent tasked with creating the page specified. It should use the vercel react best practices skill, and the frontend-design skill so that it is best equipped for the task. It should follow existing design standards and language. It should create a beautiful layout, while following any instructions given. It should leave all functionality that is not trivial to the agent in the next phase and marked with TODO comments. It should also leave comments for things that the functionality phase agent may want to know about. It should only do this when the point of some UI or function may be unclear.
3. Functionality phase: In the functionality phase, another agent will take over from what was done in the design phase, here the agent will create and connect any advanced functionality that is needed. This agent will be creating new backend routes, adding loading states, and making sure all of the UI that was built is fully functional. It should use the vercel react best practices skill. This agent should remove any comments left by the Design and UI agent. It should leave comments when code is unclear and needs a comment to explain it.
4. Review phase: This agent will review the work of both agents that came before it, it will look for things that should be optimized, potential bugs and edge cases, and just overall bad code design. It should use the vercel react best practices skill. Make sure that this agent does not overoptimize or prematurely optimize, it is simply looking for large gains that can be made easily. The code should be readable, not too verbose, not have any huge performance oversights, or bugs. But again, it is critical that this agent does not over optimize, it is simply here as a safety net to catch errors that the first two agents may have missed. If any comments were left it should remove them, unless the comments are making code that is truly unclear more clear. 

All four of the agents should follow existing standards in the codebase. 

We always use trpc for our backend routes, they are defined as:
packages\api\src\root.ts - root router
packages\api\src\routers\user-router.ts - router that has functions
packages\api\src\user\getUserInfo.ts - function for said router

New router should be created when we are building a new conceptual part of the app, so if we were adding a new admin part, we would create an admin router, and then put its functions in the "admin" folder.

Our database is defined by drizzle-orm in packages/db, when creating new files, follow the naming convention "concept-db.ts", like "users-db.ts", then, make sure to add it to the packages\db\src\schema.ts file. This can be imported from '@guitar-app/db'.

All zod schemas should be defined in packages\schemas\src\(concept)-zod.ts, and exported through packages\schemas\src\index.ts, the zod library itself should also be imported from "@guitar-app/schemas"

When each agent is done, make sure that it runs the `pnpm format` command in the root of the project, it does not need to keep the output of this command. 

We use supabase for our authentication, storage, and database provider. You can read the user object on the client from the useAuth hook, and from the trpc getUserInfo route on the server.

Make sure each task is marked as completed inside of dashboard-plans-progress.txt. The file should be updated by each agent in the format:

{task name 1} - {In progress/completed}
{last completed phase (1/2/3/4)}
{Last update timestamp}

{task name 2} - {In progress/completed}
{last completed phase (1/2/3/4)}
{Last update timestamp}

If there is anything that needs to be done outside of the codebase, like some external service settings, or api keys, write a note of it in @user-notes.txt

...

Tasks to complete:

1. We added new session tracking with 