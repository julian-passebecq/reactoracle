output "instance_summary" {
  description = "Read-only inventory of the existing Oracle instance."
  value = {
    display_name        = data.oci_core_instance.current.display_name
    shape               = data.oci_core_instance.current.shape
    state               = data.oci_core_instance.current.state
    availability_domain = data.oci_core_instance.current.availability_domain
    compartment_id      = data.oci_core_instance.current.compartment_id
  }
}
