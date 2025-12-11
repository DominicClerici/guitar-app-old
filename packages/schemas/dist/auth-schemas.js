"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUpSchema = exports.passwordSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.email().min(1, "Email is required").max(255, "Email must not exceed 255 characters"),
    password: zod_1.z
        .string()
        .min(1, "Password is required")
        .max(128, "Password must not exceed 128 characters"),
});
exports.passwordSchema = zod_1.z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password must not exceed 64 characters" })
    .refine((password) => /[A-Z]/.test(password), {
    message: "Password must contain at least one uppercase letter",
})
    .refine((password) => /[0-9]/.test(password), {
    message: "Password must contain at least one number",
})
    .refine((password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password), {
    message: "Password must contain at least one special character",
});
exports.signUpSchema = zod_1.z.object({
    firstName: zod_1.z
        .string()
        .min(1, "First name is required")
        .max(100, "First name must not exceed 100 characters"),
    lastName: zod_1.z
        .string()
        .min(1, "Last name is required")
        .max(100, "Last name must not exceed 100 characters"),
    email: zod_1.z.email().min(1, "Email is required").max(255, "Email must not exceed 255 characters"),
    password: exports.passwordSchema,
});
//# sourceMappingURL=auth-schemas.js.map