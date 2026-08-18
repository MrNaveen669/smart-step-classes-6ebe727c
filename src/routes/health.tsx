import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health")({
  component: Health,
});

function Health() {
  return <p>ok</p>;
}
