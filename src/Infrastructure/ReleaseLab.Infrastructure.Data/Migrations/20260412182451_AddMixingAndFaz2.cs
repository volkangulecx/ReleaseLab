using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReleaseLab.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMixingAndFaz2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mix_projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Progress = table.Column<short>(type: "smallint", nullable: false),
                    OutputS3Key = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    CreditsCost = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mix_projects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_mix_projects_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mix_tracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MixProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Volume = table.Column<double>(type: "double precision", nullable: false, defaultValue: 1.0),
                    Pan = table.Column<double>(type: "double precision", nullable: false, defaultValue: 0.0),
                    Muted = table.Column<bool>(type: "boolean", nullable: false),
                    Solo = table.Column<bool>(type: "boolean", nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mix_tracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_mix_tracks_files_FileId",
                        column: x => x.FileId,
                        principalTable: "files",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_mix_tracks_mix_projects_MixProjectId",
                        column: x => x.MixProjectId,
                        principalTable: "mix_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_mix_projects_UserId",
                table: "mix_projects",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_mix_tracks_FileId",
                table: "mix_tracks",
                column: "FileId");

            migrationBuilder.CreateIndex(
                name: "IX_mix_tracks_MixProjectId",
                table: "mix_tracks",
                column: "MixProjectId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mix_tracks");

            migrationBuilder.DropTable(
                name: "mix_projects");
        }
    }
}
