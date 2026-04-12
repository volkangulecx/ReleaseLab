using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReleaseLab.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReleases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "releases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobId = table.Column<Guid>(type: "uuid", nullable: true),
                    MixProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Artist = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Album = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Genre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Isrc = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    Upc = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    Year = table.Column<int>(type: "integer", nullable: true),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Copyright = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    ArtworkS3Key = table.Column<string>(type: "text", nullable: true),
                    AudioS3Key = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DistributorId = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ExternalReleaseId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ScheduledReleaseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LiveAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Spotify = table.Column<bool>(type: "boolean", nullable: false),
                    AppleMusic = table.Column<bool>(type: "boolean", nullable: false),
                    YouTube = table.Column<bool>(type: "boolean", nullable: false),
                    AmazonMusic = table.Column<bool>(type: "boolean", nullable: false),
                    Tidal = table.Column<bool>(type: "boolean", nullable: false),
                    Deezer = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_releases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_releases_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_releases_Status",
                table: "releases",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_releases_UserId",
                table: "releases",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "releases");
        }
    }
}
