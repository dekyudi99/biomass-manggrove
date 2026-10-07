import { createBrowserRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import LandingPage from "../pages/LandingPage/LandingPage";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";
import VerifyEmailPage from "../pages/Auth/VerifyEmailPage";
import AccountPage from "../pages/Auth/AccountPage";
import ForgotPasswordPage from "../pages/Auth/ForgotPasswordPage";
import AuthRoot from "./AuthRoot";
import ProtectedRoute from "./ProtectedRoute";

const router = createBrowserRouter([
    {
        element: <AuthRoot />,
        children: [
            { path: "/", element: <LandingPage /> },
            { path: "/login", element: <LoginPage /> },
            { path: "/register", element: <RegisterPage /> },
            { path: "/verify-email", element: <VerifyEmailPage /> },
            { path: "/forgot-password", element: <ForgotPasswordPage /> },
            {
                element: <ProtectedRoute />,
                children: [
                    { path: "/dashboard", element: <Dashboard /> },
                    { path: "/account", element: <AccountPage /> },
                ],
            },
            { path: "*", element: <LandingPage /> },
        ],
    },
])

export default router
