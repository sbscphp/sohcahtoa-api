# Agents Module

This module contains endpoints and business logic for **agent-managed customers**.

Initial scope:

- Allow authenticated agents to create customers \"under\" themselves by reusing
  the existing Nigerian signup (BVN) flow and linking created customers to the
  agent via the `createdByAgentId` column on the `User` model.

