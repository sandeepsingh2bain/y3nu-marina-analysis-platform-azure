import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import SimpleMarinaAnalysis from "@/pages/simple-marina-analysis";
import BatchProcessingPage from "@/pages/batch-processing";
import NotFound from "@/pages/not-found";
import { Map, Upload } from "lucide-react";

function Navigation() {
  const [location] = useLocation();
  
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <h1 className="text-lg font-semibold">Marina Analysis Platform</h1>
        </div>
        <nav className="flex items-center space-x-4 text-sm font-medium">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"}
              size="sm"
              className="h-9"
            >
              <Map className="w-4 h-4 mr-2" />
              Single Analysis
            </Button>
          </Link>
          <Link href="/batch">
            <Button 
              variant={location === "/batch" ? "default" : "ghost"}
              size="sm"
              className="h-9"
            >
              <Upload className="w-4 h-4 mr-2" />
              Batch Processing
            </Button>
          </Link>
        </nav>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
        <>
          <Navigation />
          <div className="container mx-auto py-6">
            <SimpleMarinaAnalysis />
          </div>
        </>
      )} />
      <Route path="/batch" component={() => (
        <>
          <Navigation />
          <div className="container mx-auto py-6">
            <BatchProcessingPage />
          </div>
        </>
      )} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
