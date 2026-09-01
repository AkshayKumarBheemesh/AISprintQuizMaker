import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
	return (
		<main className="flex min-h-svh items-center justify-center p-6">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>
						<h1>Create an account</h1>
					</CardTitle>
					<CardDescription>
						Register to access your QuizMaker workspace.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RegisterForm />
				</CardContent>
			</Card>
		</main>
	);
}
