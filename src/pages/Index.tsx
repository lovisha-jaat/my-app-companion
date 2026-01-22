import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Scale, Shield, FileText, MessageSquare, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ruleX</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/chat">
              <Button>
                Start Chat
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-accent/10 px-4 py-1.5 text-sm text-accent">
            <Shield className="h-4 w-4" />
            <span>Verified Government Sources Only</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Your AI-Powered Guide to{" "}
            <span className="text-primary">Indian Laws</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Get accurate, verified information on Indian finance and government laws 
            through an intelligent chatbot. Zero hallucinations, complete transparency.
          </p>
          <Link to="/chat">
            <Button size="lg" className="h-12 px-8 text-base">
              <MessageSquare className="mr-2 h-5 w-5" />
              Start Asking Questions
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-2xl font-semibold text-foreground md:text-3xl">
            Built for Legal Accuracy
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Verified Sources"
              description="All responses cite official government documents, Acts, and sections with complete references."
            />
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="Document Upload"
              description="Upload government PDFs and query specific documents for targeted legal information."
            />
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Natural Language"
              description="Ask questions in plain language. Get clear, structured answers with legal citations."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>
            ruleX provides information from official government sources. 
            This is not legal advice. Always consult a qualified professional.
          </p>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default Index;
