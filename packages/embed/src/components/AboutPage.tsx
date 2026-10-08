import logo from "../assets/logo.webp";

export function AboutPage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="about">
      <img className="about-logo" src={logo} alt="Real Talk" />
      <p>
        This chat is powered by Real Talk. To learn more, visit{" "}
        <a
          href="https://callrealtalk.com"
          target="_blank"
          rel="noopener nofollow"
        >
          callrealtalk.com
        </a>
        .
      </p>
      <button
        className="button-primary about-back"
        type="button"
        onClick={onBack}
      >
        Back to chat
      </button>
    </div>
  );
}
