// apps/web/src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🚚</span>
          <span className="text-xl font-medium text-gray-900">Truck POS</span>
        </div>
        <SignUp appearance={{ elements: { rootBox: "w-full", card: "shadow-none border border-gray-200 rounded-xl" } }} />
      </div>
    </div>
  );
}
