using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReleaseLab.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class EnhanceMixTrack : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "mix_tracks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CompressorThreshold",
                table: "mix_tracks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "EqPreset",
                table: "mix_tracks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "HighGain",
                table: "mix_tracks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "LowGain",
                table: "mix_tracks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "MidGain",
                table: "mix_tracks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "ReverbAmount",
                table: "mix_tracks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "mix_tracks");

            migrationBuilder.DropColumn(
                name: "CompressorThreshold",
                table: "mix_tracks");

            migrationBuilder.DropColumn(
                name: "EqPreset",
                table: "mix_tracks");

            migrationBuilder.DropColumn(
                name: "HighGain",
                table: "mix_tracks");

            migrationBuilder.DropColumn(
                name: "LowGain",
                table: "mix_tracks");

            migrationBuilder.DropColumn(
                name: "MidGain",
                table: "mix_tracks");

            migrationBuilder.DropColumn(
                name: "ReverbAmount",
                table: "mix_tracks");
        }
    }
}
