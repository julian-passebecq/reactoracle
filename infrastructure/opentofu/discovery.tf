# Phase 1 is deliberately read-only.
#
# The existing Oracle VM is scarce free-tier capacity and must not be
# destroyed/recreated merely to adopt infrastructure as code.
data "oci_core_instance" "current" {
  instance_id = var.instance_ocid
}
