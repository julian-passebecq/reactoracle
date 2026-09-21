# OpenTofu / OCI

This directory starts in **discovery-only mode**.

ReactOracle must not destroy and recreate the existing Oracle A1 VM merely to put it under IaC. The first phase uses the OCI provider only to inspect the current instance.

The OCI provider is compatible with OpenTofu and is pinned to the current OCI 8.25 provider line.

## Local workflow

Set OCI provider credentials through the normal OCI provider environment/configuration mechanism. Do not commit API keys.

Copy the variable example:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Then:

```bash
tofu init
tofu fmt -check
tofu validate
tofu plan
```

The current configuration contains **no managed resources**, so it cannot destroy the VM.

## Adoption phase

Later, after we inventory the actual VCN, subnet, security rules, boot volume and instance settings, we can create matching resource blocks and use `tofu import` to adopt those existing resources.

The order is:

```text
discover
  -> document
  -> reproduce configuration
  -> import existing resources
  -> plan must show no unintended changes
  -> only then allow controlled apply
```

ReactOracle's web UI should show plan history and drift, but OpenTofu execution remains in CI rather than on the Oracle VM.
