"use client";
"use no memo"; // react-hook-form uses mutable refs incompatible with React Compiler

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useLogin, useSignup } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { useHaptics } from "@/hooks/use-haptics";
import Image from "next/image";
import { APP_NAME_SHORT } from "@/data/app";

const FLOAT_EMOJIS = ["🎸", "🏀", "🎨", "⏱️", "🏆", "🎵", "⌨️", "📚", "🎯", "🧘", "🎹", "⚽", "🏋️", "📷", "🎤", "♟️", "🎻", "✏️"];

function FloatingEmojis() {
  // Place emojis in a ring using % offsets so it scales with viewport
  const items = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const radius = 38 + (i % 3) * 8; // % of container width
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    return {
      emoji: FLOAT_EMOJIS[i % FLOAT_EMOJIS.length],
      x,
      y,
      duration: 12 + (i % 4) * 3,
      delay: (i % 6) * 0.5,
      size: 1.2 + (i % 3) * 0.4,
    };
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((item, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: `clamp(${item.size}rem, ${item.size + 1}vw, ${item.size + 1}rem)`,
            animation: `float-drift ${item.duration}s ease-in-out ${item.delay}s infinite`,
            opacity: 0,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof signupSchema>;

export function AuthForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const { trigger } = useHaptics();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: standardSchemaResolver(isLogin ? loginSchema : signupSchema),
    mode: "onBlur",
  });

  const login = useLogin();
  const signup = useSignup();
  const mutation = isLogin ? login : signup;

  function onSubmit(data: FormData) {
    clearErrors("root");
    mutation.mutate(data, {
      onSuccess: () => {
        trigger("success");
        router.push("/routines");
      },
      onError: (err) => {
        trigger("error");
        if (err instanceof ApiError) {
          if (err.status === 409) {
            setError("username", {
              message: "An account with this username already exists",
            });
          } else if (err.status === 401) {
            setError("root", { message: "Invalid username or password" });
          } else {
            setError("root", { message: err.message });
          }
        } else {
          setError("root", {
            message: "Something went wrong. Please try again.",
          });
        }
      },
    });
  }

  function toggleMode() {
    trigger("selection");
    setIsLogin(!isLogin);
    reset();
  }

  const formContent = (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete={isLogin ? "username" : "username"}
            {...register("username")}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? "username-error" : undefined}
            className="bg-background"
          />
          {errors.username && (
            <p id="username-error" className="text-sm text-destructive">
              {errors.username.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="bg-background"
          />
          {errors.password ? (
            <p id="password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : !isLogin ? (
            <p className="text-sm text-muted-foreground">
              Must be at least 8 characters
            </p>
          ) : null}
        </div>
        {errors.root && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2"
          >
            <p className="text-sm text-destructive">{errors.root.message}</p>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "..." : isLogin ? "Sign In" : "Sign Up"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-4">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={toggleMode}
          className="underline text-primary"
        >
          {isLogin ? "Sign up" : "Sign in"}
        </button>
      </p>
    </>
  );

  if (isLogin) {
    return (
      <div className="relative min-h-screen flex flex-col items-center pt-[15vh] px-4 bg-background">
        <FloatingEmojis />
        <Image
          src="/icon.webp"
          alt={APP_NAME_SHORT}
          width={48}
          height={48}
          className="relative mb-4"
        />
        <h1 className="relative text-2xl font-light mb-6">Sign in to {APP_NAME_SHORT}</h1>
        <Card className="relative w-full max-w-sm">
          <CardContent className="pt-6">{formContent}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Hero panel */}
      <div className="lg:w-1/2 flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-16 lg:min-h-screen">
        <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-foreground">
          Create your free account
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Start logging your grind toward mastery.
        </p>
        <div className="relative mt-8 h-64 lg:flex-1 lg:h-auto">
          <Image
            src="/signup-hero.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Divider */}
      <div className="relative lg:hidden flex items-center justify-center py-2">
        <div className="absolute inset-0 flex items-center px-8">
          <div className="w-full border-t border-primary/20" />
        </div>
        <div className="relative bg-background px-3">
          <Image src="/icon.webp" alt="" width={28} height={28} />
        </div>
      </div>
      <div className="hidden lg:flex items-center">
        <div className="w-px h-2/3 bg-linear-to-b from-transparent via-primary/30 to-transparent" />
      </div>

      {/* Form panel */}
      <div className="lg:w-1/2 flex flex-col items-center justify-center px-4 py-12 lg:py-0">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/icon.webp"
              alt={APP_NAME_SHORT}
              width={48}
              height={48}
              className="mb-4 hidden lg:block"
            />
            <h2 className="text-2xl font-light">Sign up for {APP_NAME_SHORT}</h2>
          </div>
          <Card>
            <CardContent className="pt-6">{formContent}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
