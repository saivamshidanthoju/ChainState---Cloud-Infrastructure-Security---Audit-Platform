# Destructive Change: RDS Database Instance with force_destroy (HIGH Risk)
resource "aws_db_instance" "production_database" {
  allocated_storage   = 100
  engine              = "postgres"
  engine_version      = "15.3"
  instance_class      = "db.r5.large"
  db_name             = "chainstate_prod"
  skip_final_snapshot = true
  force_destroy       = true
  deletion_protection = false
}
