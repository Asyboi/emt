import {
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
};

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  style,
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            window.setTimeout(() => el.classList.add("in"), delay * 1000);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={`reveal ${className ?? ""}`} style={style}>
      {children}
    </Tag>
  );
}

type RevealWordsProps = {
  children: ReactNode;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
  delay?: number;
  stagger?: number;
};

const wrapWords = (node: ReactNode): ReactNode => {
  if (typeof node === "string") {
    const parts = node.split(/(\s+)/);
    return parts.map((p, i) => {
      if (p === "") return null;
      if (/^\s+$/.test(p)) return p;
      return (
        <span key={i} className="reveal-word">
          {p}
        </span>
      );
    });
  }
  if (Array.isArray(node)) {
    return node.map((n, i) => <Fragment key={i}>{wrapWords(n)}</Fragment>);
  }
  if (isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: ReactNode }>;
    return cloneElement(element, undefined, wrapWords(element.props.children));
  }
  return node;
};

type ScrollLitTextProps = {
  children: string;
  startY?: number;
  range?: number;
  className?: string;
  style?: CSSProperties;
};

export function ScrollLitText({
  children,
  startY = 0,
  range,
  className,
  style,
}: ScrollLitTextProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const span = range ?? window.innerHeight * 0.6;
      const t = (window.scrollY - startY) / span;
      setProgress(Math.max(0, Math.min(1, t)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [startY, range]);

  const tokens = children.split(/(\s+)/);
  const wordCount = tokens.filter((t) => /\S/.test(t)).length || 1;
  let wordIdx = 0;

  return (
    <span className={className} style={style}>
      {tokens.map((tok, i) => {
        if (!/\S/.test(tok)) return <Fragment key={i}>{tok}</Fragment>;
        const myT = (wordIdx + 0.5) / wordCount;
        wordIdx += 1;
        const lit = progress >= myT;
        return (
          <span
            key={i}
            style={{
              color: lit ? "var(--text)" : "var(--text-2)",
              transition: "color 0.35s ease",
            }}
          >
            {tok}
          </span>
        );
      })}
    </span>
  );
}

export function RevealWords({
  children,
  as: Tag = "span",
  style,
  className,
  delay = 0,
  stagger = 0.06,
}: RevealWordsProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll<HTMLElement>(".reveal-word");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            words.forEach((w, i) => {
              window.setTimeout(
                () => w.classList.add("in"),
                (delay + i * stagger) * 1000,
              );
            });
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay, stagger]);

  return (
    <Tag ref={ref} style={style} className={className}>
      {wrapWords(children)}
    </Tag>
  );
}
