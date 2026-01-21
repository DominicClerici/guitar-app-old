This is a project that helps users learn the guitar. The name of this product is StringFlow.

You are working in a monorepo with folders:
- /frontend a next.js v16 react v19 project.
- /mobile a react native v19 expo v54 project.
- /packages a shared package directory with:
- - /api our lambda backend with trpc 
- - /db our database schema defined by drizzle orm. import ... from "@guitar/db"
- - /schemas shared zod schemas for validation. import ... from "@guitar/schemas"

When adding packages, never write directly to a package.json file, instead use `pnpm add` or `npx expo install`

Do not write comments that are redundant. Only write comments when the code may be confusing, and a comment will clear up the confusion.

When working in the /frontend directory, always use shadcn components imported from "@/components/ui/{comp}" when applicable. In this project you can use the shadcn components from the list:
- button
- input
- separator
- card
- checkbox
- switch
- dropdown menu
- radio group
- select
- dialog
- alert dialog
- tooltip
- popover
- skeleton
- tabs
- accordion
- badge
- slider
- textarea

For icons, we have lucide-react and lucide-react-native installed to use in the /frontend and /mobile projects.

For all backend functionality, use the trpc shared package. In /frontend, you can import from "@/lib/trpc/react" for client components (tanstack react query) OR  "@/lib/trpc/server" for server components, route files, and server actions. 

When you need to validate any data, create a zod schema in /packages/schemas and import it.

In /mobile, you can import from "@/lib/trpc/react" (tanstack react query)

You can type check your solution with `pnpm run type-check`

When typing objects, variables, and functions, only manually specify types if it is needed, otherwise, prefer to just use inferred types.