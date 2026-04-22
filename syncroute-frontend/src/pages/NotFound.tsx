import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="font-display font-bold text-8xl text-foreground mb-4">404</h1>
          <h2 className="font-display font-semibold text-2xl text-foreground mb-3">
            Page not found
          </h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="btn btn-primary btn-md inline-flex"
          >
            <Home className="h-4 w-4" />
            Go home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn btn-outline btn-md inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
