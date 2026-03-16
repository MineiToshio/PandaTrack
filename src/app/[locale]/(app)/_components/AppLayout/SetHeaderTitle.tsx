"use client";

import { useEffect } from "react";
import { useHeaderTitle } from "./HeaderTitleContext";

type SetHeaderTitleProps = {
  title: string | null;
};

/**
 * Sets the app content header title for the current page (e.g. store name on store detail).
 * Clears the title on unmount so sibling routes show the default title.
 */
export default function SetHeaderTitle({ title }: SetHeaderTitleProps) {
  const { setTitle } = useHeaderTitle();

  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);

  return null;
}
