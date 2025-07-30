import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Settings, Users } from "lucide-react";

const Navbar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b border-border z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          WixImporter
        </Link>
        
        <div className="hidden md:flex items-center gap-4">
           <Link to="/import">
            <Button 
              variant={isActive("/import") ? "default" : "ghost"} 
              size="sm"
              className="gap-2"
            >
              <Users size={16} />
              Import Users
            </Button>
          </Link>
          <Link to="/contact">
            <Button 
              variant={isActive("/contact") ? "default" : "ghost"} 
              size="sm"
              className="gap-2"
            >
              <Mail size={16} />
              Contact
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;