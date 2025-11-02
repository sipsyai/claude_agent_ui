#!/usr/bin/env python3
"""
Skill Finder Helper Script
Usage: python find_skill.py <skill_name>

Finds a skill by name and returns:
- Skill ID from Strapi
- Local SKILL.md file path
- Current version
"""

import requests
import sys
import os
import json

def find_skill(skill_name):
    """Find skill by name in Strapi and local filesystem"""

    results = {
        "skill_id": None,
        "skill_path": None,
        "current_version": None,
        "skillmd_from_strapi": None,
        "skillmd_preview": None,
        "found_in_strapi": False,
        "found_locally": False,
        "error": None
    }

    # 1. Search in Strapi
    try:
        url = "http://localhost:3001/api/strapi/skills"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            data = response.json()

            # API returns {data: [...]} format
            skills = data.get('data', []) if isinstance(data, dict) else data
            if not isinstance(skills, list):
                skills = []

            # Search for skill by name
            for skill in skills:
                if isinstance(skill, dict) and skill.get('name') == skill_name:
                    results['skill_id'] = skill.get('id')
                    results['current_version'] = skill.get('version', '1.0.0')

                    # Get skillmd content from Strapi
                    skillmd = skill.get('skillmd', '')
                    results['skillmd_from_strapi'] = skillmd

                    # Create preview (first 200 chars)
                    if skillmd:
                        preview = skillmd[:200] + '...' if len(skillmd) > 200 else skillmd
                        results['skillmd_preview'] = preview

                    results['found_in_strapi'] = True
                    break
        else:
            results['error'] = f"Strapi API returned {response.status_code}"

    except Exception as e:
        results['error'] = f"Failed to connect to Strapi: {str(e)}"

    # 2. Search in local filesystem
    base_path = r"C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills"
    skill_path = os.path.join(base_path, skill_name, "SKILL.md")

    if os.path.exists(skill_path):
        results['skill_path'] = skill_path
        results['found_locally'] = True

        # Extract version from SKILL.md frontmatter
        try:
            with open(skill_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'version:' in content:
                    for line in content.split('\n'):
                        if line.strip().startswith('version:'):
                            version = line.split(':', 1)[1].strip()
                            if not results['current_version']:
                                results['current_version'] = version
                            break
        except Exception as e:
            pass

    return results

def print_results(skill_name, results):
    """Print results in a readable format"""

    print(f"\n{'='*60}")
    print(f"SKILL SEARCH RESULTS: {skill_name}")
    print(f"{'='*60}\n")

    if results['found_in_strapi']:
        print(f"[OK] Found in Strapi")
        print(f"     Skill ID: {results['skill_id']}")
        print(f"     Version:  {results['current_version']}")

        # Show skillmd preview if available
        if results['skillmd_preview']:
            print(f"\n     Skillmd Preview:")
            # Indent each line of preview
            for line in results['skillmd_preview'].split('\n'):
                print(f"     {line}")
        elif results['skillmd_from_strapi'] is None:
            print(f"     Skillmd: None (not set in Strapi)")
    else:
        print(f"[FAIL] Not found in Strapi")
        if results['error']:
            print(f"       Error: {results['error']}")

    print()

    if results['found_locally']:
        print(f"[OK] Found locally")
        print(f"     Path: {results['skill_path']}")
    else:
        print(f"[FAIL] Not found locally")
        print(f"       Expected: .claude/skills/{skill_name}/SKILL.md")

    print(f"\n{'='*60}\n")

    # Return JSON for easy parsing
    if results['found_in_strapi'] and results['found_locally']:
        print("JSON OUTPUT (for script usage):")

        # Create a JSON-safe version (exclude full skillmd, too large)
        json_output = {
            "skill_id": results['skill_id'],
            "skill_path": results['skill_path'],
            "current_version": results['current_version'],
            "skillmd_length": len(results['skillmd_from_strapi']) if results['skillmd_from_strapi'] else 0,
            "found_in_strapi": results['found_in_strapi'],
            "found_locally": results['found_locally'],
            "error": results['error']
        }

        print(json.dumps(json_output, indent=2))

        # Optionally save full skillmd to file
        if results['skillmd_from_strapi']:
            print(f"\nFull skillmd available in results (use --save-skillmd flag to write to file)")

        return True

    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python find_skill.py <skill_name> [--save-skillmd]")
        print("\nExample:")
        print("  python find_skill.py rpa-challenge")
        print("  python find_skill.py rpa-challenge --save-skillmd")
        print("\nOptions:")
        print("  --save-skillmd   Save Strapi skillmd to temp/skillmd_from_strapi.md")
        sys.exit(1)

    skill_name = sys.argv[1]
    save_skillmd = '--save-skillmd' in sys.argv

    results = find_skill(skill_name)
    found = print_results(skill_name, results)

    # Save skillmd to file if requested
    if save_skillmd and results['skillmd_from_strapi']:
        output_path = r"C:\Users\Ali\Documents\Projects\claude_agent_ui\temp\skillmd_from_strapi.md"
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(results['skillmd_from_strapi'])
            print(f"\n[OK] Skillmd saved to: {output_path}")
            print(f"     Size: {len(results['skillmd_from_strapi'])} characters")
        except Exception as e:
            print(f"\n[FAIL] Could not save skillmd: {str(e)}")

    # Export variables for shell usage
    if found:
        print("\nSHELL EXPORT COMMANDS:")
        print(f"export SKILL_ID='{results['skill_id']}'")
        print(f"export SKILL_PATH='{results['skill_path']}'")
        print(f"export SKILL_VERSION='{results['current_version']}'")

        # Also return results object for programmatic usage
        print("\nPYTHON USAGE:")
        print("To use in Python scripts, import and call find_skill(skill_name)")

    sys.exit(0 if found else 1)
