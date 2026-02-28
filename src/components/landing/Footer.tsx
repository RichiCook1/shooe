const Footer = () => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-display text-gradient">RunReview</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} RunReview. Every mile deserves a review.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
