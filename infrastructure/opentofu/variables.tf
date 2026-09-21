variable "region" {
  description = "OCI region containing the existing ReactOracle VM."
  type        = string
}

variable "instance_ocid" {
  description = "OCID of the existing Oracle VM. This configuration discovers it read-only; it does not recreate it."
  type        = string
  sensitive   = true
}
