"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { loginAction, type AuthFormState } from "@/lib/actions/auth-actions";
import { loginSchema } from "@/lib/schemas/auth-schema";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LoginInput = z.input<typeof loginSchema>;

export function LoginForm({ initialState }: { initialState?: AuthFormState }) {
	const [state, formAction, pending] = useActionState(loginAction, initialState ?? {});
	const form = useForm<LoginInput>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: initialState?.values?.email ?? "",
			password: "",
		},
	});

	const fieldError = (name: keyof LoginInput) => {
		const message = form.formState.errors[name]?.message;
		return message ? [{ message }] : undefined;
	};

	const formErrors = state.errors?.form?.map((message) => ({ message }));

	return (
		<form
			noValidate
			action={formAction}
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit((values) => {
					const data = new FormData();
					data.set("email", values.email);
					data.set("password", values.password);
					startTransition(() => {
						formAction(data);
					});
				})(event);
			}}
		>
			<FieldSet>
				<FieldGroup>
					<Field data-invalid={Boolean(form.formState.errors.email)}>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							aria-invalid={Boolean(form.formState.errors.email)}
							aria-errormessage={
								form.formState.errors.email ? "email-error" : undefined
							}
							{...form.register("email")}
						/>
						<FieldError id="email-error" errors={fieldError("email")} />
					</Field>

					<Field data-invalid={Boolean(form.formState.errors.password)}>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							aria-invalid={Boolean(form.formState.errors.password)}
							aria-errormessage={
								form.formState.errors.password ? "password-error" : undefined
							}
							{...form.register("password")}
						/>
						<FieldError id="password-error" errors={fieldError("password")} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<FieldError className="mt-4" errors={formErrors} />

			<Button type="submit" className="mt-6 w-full" disabled={pending}>
				Sign in
			</Button>

			<p className="mt-4 text-center text-sm text-muted-foreground">
				Need an account?{" "}
				<Link
					href="/register"
					className="text-foreground underline-offset-4 hover:underline"
				>
					Create an account
				</Link>
			</p>
		</form>
	);
}
