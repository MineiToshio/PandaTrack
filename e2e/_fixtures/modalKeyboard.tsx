import { useState } from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import Modal from "../../src/components/modules/Modal/Modal";
import Input from "../../src/components/core/Input";
import common from "../../src/i18n/locales/en/common.json";
import "../../src/app/globals.css";

function KeyboardFixture() {
  const [isOpen, setIsOpen] = useState(false);
  const isExpanded = new URLSearchParams(window.location.search).has("expanded");
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <NextIntlClientProvider locale="en" messages={{ common }}>
      <button type="button" onClick={handleOpen}>
        Open fixture
      </button>
      <Modal
        isOpen={isOpen}
        title="Keyboard fixture"
        subtitle="Isolated component, no application data"
        onClose={handleClose}
        className={isExpanded ? "[--sheet-max-height:92dvh]" : undefined}
        primaryAction={{ label: "Confirm fixture", onClick: handleClose }}
      >
        <div style={{ height: 500 }} aria-hidden="true" />
        <Input aria-label="Amount fixture" />
        <Input aria-label="Note fixture" />
      </Modal>
    </NextIntlClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<KeyboardFixture />);
