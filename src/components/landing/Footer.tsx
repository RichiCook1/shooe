const Footer = () => {
  return (
    <footer className="py-10 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-display uppercase tracking-wider">Sherpa</span>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            © {new Date().getFullYear()} Sherpa. Every mile counts.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
