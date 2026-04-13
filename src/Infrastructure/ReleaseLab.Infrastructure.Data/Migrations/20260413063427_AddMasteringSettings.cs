using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReleaseLab.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMasteringSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MasteringSettings",
                table: "jobs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MasteringSettings",
                table: "jobs");
        }
    }
}
