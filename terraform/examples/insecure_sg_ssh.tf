# Insecure Security Group: Open SSH Port 22 to 0.0.0.0/0 (HIGH Risk)
resource "aws_security_group" "open_ssh" {
  name        = "allow-world-ssh"
  description = "Allows SSH access directly from the internet"
  vpc_id      = "vpc-01928374"

  ingress {
    description = "Public SSH Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
