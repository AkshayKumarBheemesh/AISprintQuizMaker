"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { registerAction, type AuthFormState } from "@/lib/actions/auth-actions";
import { registerSchema } from "@/lib/schemas/auth-schema";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type RegisterInput = z.input<typeof registerSchema>;

export function RegisterForm({ initialState }: { initialState?: AuthFormState }) {
	const [state, formAction, pending] = useActionState(registerAction, initialState ?? {});
	const form = useForm<RegisterInput>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			firstName: initialState?.values?.firstName ?? "",
			lastName: initialState?.values?.lastName ?? "",
			email: initialState?.values?.email ?? "",
			password: "",
			confirmPassword: "",
		},
	});

	const fieldError = (name: keyof RegisterInput, server?: string[]) => {
		const client = form.formState.errors[name]?.message;
		const messages = [client, ...(server ?? [])].filter((message): message is string =>
			Boolean(message),
		);
		return messages.map((message) => ({ message }));
	};

	return (
		<form
			noValidate
			action={formAction}
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit((values) => {
					const data = new FormData();
					data.set("firstName", values.firstName);
					data.set("lastName", values.lastName);
					data.set("email", values.email);
					data.set("password", values.password);
					data.set("confirmPassword", values.confirmPassword);
					startTransition(() => {
						formAction(data);
					});
				})(event);
			}}
		>
			<FieldSet>
				<FieldGroup>
					<Field data-invalid={Boolean(form.formState.errors.firstName)}>
						<FieldLabel htmlFor="firstName">First name</FieldLabel>
						<Input
							id="firstName"
							autoComplete="given-name"
							aria-invalid={Boolean(form.formState.errors.firstName)}
							aria-errormessage={
								form.formState.errors.firstName ? "firstName-error" : undefined
							}
							{...form.register("firstName")}
						/>
						<FieldError id="firstName-error" errors={fieldError("firstName")} />
					</Field>

					<Field data-invalid={Boolean(form.formState.errors.lastName)}>
						<FieldLabel htmlFor="lastName">Last name</FieldLabel>
						<Input
							id="lastName"
							autoComplete="family-name"
							aria-invalid={Boolean(form.formState.errors.lastName)}
							aria-errormessage={
								form.formState.errors.lastName ? "lastName-error" : undefined
							}
							{...form.register("lastName")}
						/>
						<FieldError id="lastName-error" errors={fieldError("lastName")} />
					</Field>

					<Field
						data-invalid={Boolean(
							form.formState.errors.email || state.errors?.email?.length,
						)}
					>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							aria-invalid={Boolean(
								form.formState.errors.email || state.errors?.email?.length,
							)}
							aria-errormessage={
								form.formState.errors.email || state.errors?.email?.length
									? "email-error"
									: undefined
							}
							{...form.register("email")}
						/>
						<FieldError
							id="email-error"
							errors={fieldError("email", state.errors?.email)}
						/>
					</Field>

					<Field data-invalid={Boolean(form.formState.errors.password)}>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							type="password"
							autoComplete="new-password"
							aria-invalid={Boolean(form.formState.errors.password)}
							aria-errormessage={
								form.formState.errors.password ? "password-error" : undefined
							}
							{...form.register("password")}
						/>
						<FieldError id="password-error" errors={fieldError("password")} />
					</Field>

					<Field data-invalid={Boolean(form.formState.errors.confirmPassword)}>
						<FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
						<Input
							id="confirmPassword"
							type="password"
							autoComplete="new-password"
							aria-invalid={Boolean(form.formState.errors.confirmPassword)}
							aria-errormessage={
								form.formState.errors.confirmPassword
									? "confirmPassword-error"
									: undefined
							}
							{...form.register("confirmPassword")}
						/>
						<FieldError
							id="confirmPassword-error"
							errors={fieldError("confirmPassword")}
						/>
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" className="mt-6 w-full" disabled={pending}>
				Create account
			</Button>

			<p className="mt-4 text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href="/login" className="text-foreground underline-offset-4 hover:underline">
					Sign in
				</Link>
			</p>
		</form>
	);
}
